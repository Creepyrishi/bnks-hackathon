#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Head-controlled mouse with blink clicks + on-screen deadzone indicator (improved)

Requirements:
  pip install opencv-python mediapipe pyautogui

Notes:
- On macOS, grant Terminal/Python accessibility control (System Settings → Privacy & Security → Accessibility).
- On Linux Wayland, pyautogui may not work; use an X11 session or alternative backends.
- On Windows high-DPI displays, you may want to enable DPI awareness (see commented code below).
"""

import os
import sys
import math
import time
import threading
from collections import deque

# Optional: improve scaling on high-DPI Windows
if os.name == "nt":
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

import cv2
import pyautogui

# Configure pyautogui behavior
pyautogui.PAUSE = 0.0
# Keep failsafe on for safety; move mouse to top-left corner to abort.
# Set to False if you experience unwanted aborts.
pyautogui.FAILSAFE = True

# -------------------------------
# Config
# -------------------------------
# Movement & smoothing
SENSITIVITY = 1400.0         # pixels per normalized unit movement
DEAD_ZONE = 0.010            # ignore micro head motion below this magnitude
EMA_ALPHA = 0.35             # smoothing strength (0..1), higher = more responsive
MAX_STEP = 0.12              # clamp per-frame normalized move (prevents sudden jumps)

# Calibration
CALIBRATION_FRAMES = 30      # frames to average for neutral during calibration
AUTO_CALIBRATE_ON_START = True

# Eye blink detection
EAR_THRESHOLD = 0.20         # eye-aspect-ratio below this = eye closed
BLINK_HOLD_SEC = 0.15        # minimum time eye must stay "closed" to trigger
BOTH_EYES_ACTION = "left"    # "none", "left", "double_left"

# UI / Tk indicator
RADIUS = 16
OFFSET_Y = 40
MAX_DISPLAY = 0.05           # normalized dx/dy corresponding to indicator radius
TK_REFRESH_MS = 10

# Capture
CAM_INDEX = 0
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# -------------------------------
# Tkinter UI (deadzone indicator)
# -------------------------------
import tkinter as tk

dx_shared = 0.0
dy_shared = 0.0
move_enabled = True
status_text = "RUN"
lock = threading.Lock()

root = tk.Tk()
root.overrideredirect(True)
root.attributes("-topmost", True)
# Try to make white background transparent (Windows). Safe no-op on others.
try:
    root.attributes("-transparentcolor", "white")
except tk.TclError:
    pass

canvas = tk.Canvas(root, width=RADIUS*2, height=RADIUS*2, highlightthickness=0, bg="white")
canvas.pack()

# Visuals: outer ring (deadzone) + crosshair + pointer dot
deadzone_circle = canvas.create_oval(0, 0, RADIUS*2, RADIUS*2, outline="#FFD54F", width=3)
cross_v = canvas.create_line(RADIUS, 2, RADIUS, 2*RADIUS-2, fill="#BDBDBD", width=1)
cross_h = canvas.create_line(2, RADIUS, 2*RADIUS-2, RADIUS, fill="#BDBDBD", width=1)
head_pointer = canvas.create_oval(RADIUS-3, RADIUS-3, RADIUS+3, RADIUS+3, fill="#E53935", outline="")

def update_deadzone_indicator():
    # position small window near the OS pointer
    x, y = root.winfo_pointerx(), root.winfo_pointery()
    root.geometry(f"{RADIUS*2}x{RADIUS*2}+{x-RADIUS}+{y+OFFSET_Y-RADIUS}")

    with lock:
        dx = dx_shared
        dy = dy_shared

    # map normalized dx/dy into ring
    px = RADIUS + int((dx / MAX_DISPLAY) * RADIUS)
    py = RADIUS + int((dy / MAX_DISPLAY) * RADIUS)
    px = max(0, min(2*RADIUS, px))
    py = max(0, min(2*RADIUS, py))
    canvas.coords(head_pointer, px-3, py-3, px+3, py+3)

    root.after(TK_REFRESH_MS, update_deadzone_indicator)

root.after(TK_REFRESH_MS, update_deadzone_indicator)

# -------------------------------
# MediaPipe FaceMesh (import deferred to keep start-up fast if missing)
# -------------------------------
import mediapipe as mp
mp_face_mesh = mp.solutions.face_mesh

# Landmarks for EAR calculation (MediaPipe indices)
LEFT_EYE_POINTS  = [33, 160, 158, 133, 153, 144]   # [left, top1, top2, right, bot1, bot2]
RIGHT_EYE_POINTS = [362, 385, 387, 263, 373, 380]  # [left, top1, top2, right, bot1, bot2]

def euclidean_dist(p1, p2):
    return math.hypot(p1[0]-p2[0], p1[1]-p2[1])

def calculate_ear(landmarks, eye_points, w, h):
    pts = [(int(landmarks.landmark[i].x * w), int(landmarks.landmark[i].y * h)) for i in eye_points]
    A = euclidean_dist(pts[1], pts[5])
    B = euclidean_dist(pts[2], pts[4])
    C = euclidean_dist(pts[0], pts[3])
    if C == 0:
        C = 1e-6
    return (A + B) / (2.0 * C)

# -------------------------------
# OpenCV processing thread
# -------------------------------
stop_event = threading.Event()

def opencv_loop():
    global dx_shared, dy_shared

    cap = cv2.VideoCapture(CAM_INDEX)
    if FRAME_WIDTH and FRAME_HEIGHT:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    if not cap.isOpened():
        print("[ERROR] Could not open camera index", CAM_INDEX)
        root.quit()
        return

    # Build FaceMesh with explicit parameters for stable behavior
    with mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:

        neutral_x = None
        neutral_y = None
        ema_dx = 0.0
        ema_dy = 0.0

        # Calibration buffers
        cal_qx = deque(maxlen=CALIBRATION_FRAMES)
        cal_qy = deque(maxlen=CALIBRATION_FRAMES)
        calibrating = AUTO_CALIBRATE_ON_START

        # Blink tracking
        left_closed_since = None
        right_closed_since = None
        both_closed_since = None
        left_ready = True   # require re-open before next click
        right_ready = True
        both_ready = True

        # FPS calc
        fps_ts = time.time()
        fps_frames = 0
        fps_val = 0.0

        window_name = "Head Tracking Video"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        try:
            cv2.setWindowProperty(window_name, cv2.WND_PROP_TOPMOST, 0)
        except Exception:
            pass

        while not stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                continue

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)
            now = time.time()

            dx_raw = dy_raw = 0.0
            if results.multi_face_landmarks:
                landmarks = results.multi_face_landmarks[0]

                # Head center via eye centers
                left_eye = landmarks.landmark[33]
                right_eye = landmarks.landmark[263]
                cx = (left_eye.x + right_eye.x) / 2.0
                cy = (left_eye.y + right_eye.y) / 2.0

                # Calibration
                if calibrating:
                    cal_qx.append(cx)
                    cal_qy.append(cy)
                    if len(cal_qx) >= CALIBRATION_FRAMES:
                        neutral_x = sum(cal_qx) / len(cal_qx)
                        neutral_y = sum(cal_qy) / len(cal_qy)
                        calibrating = False
                elif neutral_x is None:
                    # First-time neutral if calibration disabled
                    neutral_x, neutral_y = cx, cy

                if neutral_x is not None:
                    dx_raw = cx - neutral_x
                    dy_raw = cy - neutral_y

                # EAR & blink logic
                left_ear  = calculate_ear(landmarks, LEFT_EYE_POINTS,  w, h)
                right_ear = calculate_ear(landmarks, RIGHT_EYE_POINTS, w, h)

                left_closed  = left_ear  < EAR_THRESHOLD
                right_closed = right_ear < EAR_THRESHOLD

                # Both closed handling
                if left_closed and right_closed:
                    if both_ready:
                        if both_closed_since is None:
                            both_closed_since = now
                        elif now - both_closed_since >= BLINK_HOLD_SEC:
                            if BOTH_EYES_ACTION == "left":
                                safe_click("left")
                            elif BOTH_EYES_ACTION == "double_left":
                                safe_click("left"); safe_click("left")
                            both_ready = False
                            both_closed_since = None
                    # while both closed, single-eye clicks are suppressed
                    left_closed_since = None
                    right_closed_since = None
                else:
                    both_closed_since = None
                    if not left_closed and not right_closed:
                        both_ready = True

                    # Left wink: left click
                    if left_closed and not right_closed:
                        if left_ready:
                            if left_closed_since is None:
                                left_closed_since = now
                            elif now - left_closed_since >= BLINK_HOLD_SEC:
                                safe_click("left")
                                left_ready = False
                                left_closed_since = None
                    else:
                        left_closed_since = None
                        if not left_closed:
                            left_ready = True

                    # Right wink: right click
                    if right_closed and not left_closed:
                        if right_ready:
                            if right_closed_since is None:
                                right_closed_since = now
                            elif now - right_closed_since >= BLINK_HOLD_SEC:
                                safe_click("right")
                                right_ready = False
                                right_closed_since = None
                    else:
                        right_closed_since = None
                        if not right_closed:
                            right_ready = True

            # Smoothing & movement
            ema_dx = ema_dx * (1.0 - EMA_ALPHA) + dx_raw * EMA_ALPHA
            ema_dy = ema_dy * (1.0 - EMA_ALPHA) + dy_raw * EMA_ALPHA

            # clamp per-frame step
            mx = max(-MAX_STEP, min(MAX_STEP, ema_dx))
            my = max(-MAX_STEP, min(MAX_STEP, ema_dy))

            # move cursor if outside deadzone and enabled
            dist = math.hypot(mx, my)
            if move_enabled and dist > DEAD_ZONE:
                try:
                    pyautogui.moveRel(mx * SENSITIVITY, my * SENSITIVITY, duration=0)
                except pyautogui.FailSafeException:
                    # user hit failsafe; pause movement but keep app alive
                    pass

            # share dx/dy for Tk indicator
            with lock:
                dx_shared = ema_dx
                dy_shared = ema_dy

            # Overlay HUD
            fps_frames += 1
            if now - fps_ts >= 1.0:
                fps_val = fps_frames / (now - fps_ts)
                fps_frames = 0
                fps_ts = now

            hud = [
                f"FPS: {fps_val:4.1f}",
                f"Move: {'ON' if move_enabled else 'OFF'}  (M to toggle)",
                f"Space/C: Calibrate  |  Q/Esc: Quit",
                f"Both eyes: {BOTH_EYES_ACTION}  |  Wink L/R: Left/Right click",
            ]
            y0 = 24
            for line in hud:
                cv2.putText(frame, line, (10, y0), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 4, cv2.LINE_AA)
                cv2.putText(frame, line, (10, y0), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1, cv2.LINE_AA)
                y0 += 24

            if calibrating:
                msg = "Calibrating... keep your head still"
                cv2.putText(frame, msg, (10, y0+6), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,0), 4, cv2.LINE_AA)
                cv2.putText(frame, msg, (10, y0+6), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2, cv2.LINE_AA)

            cv2.imshow(window_name, frame)

            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord('q')):  # ESC or q
                break
            elif key in (ord(' '), ord('c')):  # calibrate
                cal_qx.clear(); cal_qy.clear()
                calibrating = True
            elif key == ord('m'):
                # toggle mouse movement
                move_enabled = not move_enabled
            elif key == ord('b'):
                # cycle both-eyes action
                vals = ["none", "left", "double_left"]
                i = (vals.index(BOTH_EYES_ACTION) if BOTH_EYES_ACTION in vals else 0) + 1
                i %= len(vals)
                globals()["BOTH_EYES_ACTION"] = vals[i]

        cap.release()
        cv2.destroyAllWindows()
    root.quit()

def safe_click(button="left"):
    try:
        pyautogui.click(button=button)
    except pyautogui.FailSafeException:
        pass

# Run OpenCV in worker thread to keep Tk responsive
worker = threading.Thread(target=opencv_loop, daemon=True)
worker.start()
try:
    root.mainloop()
finally:
    stop_event.set()
    try:
        worker.join(timeout=1.0)
    except RuntimeError:
        pass