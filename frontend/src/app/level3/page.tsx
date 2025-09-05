"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GameArea from "@/components/GameArea";
import ToastLogger from "@/components/ToastLogger";

export default function Level3() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showCompletion, setShowCompletion] = useState<boolean>(false);

  // Restore completed status on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const c = localStorage.getItem("completedLevel3");
      const parsedStep = c ? parseInt(c, 10) : 0;
      setCurrentStep(isNaN(parsedStep) ? 0 : parsedStep);
    }
  }, []);

  function handleComplete() {
    // GameArea calls this only when the 1 task is completed
    setCurrentStep(1);
    localStorage.setItem("completedLevel3", "1");
    setShowCompletion(true);
  }

  function handleFail() {
    // Optionally reset or show a toast
  }

 
  function goToHome() {
    router.push("/");
  }

  return (
    <div className="bg-black h-screen w-full relative overflow-hidden">
      <div className="absolute top-4 left-8 text-lg z-10 text-white">
        Level 3: Complete 1 task (Fast moving, small target)
      </div>
      <div className="absolute top-4 right-8 text-lg z-10 text-white">
        Progress: {currentStep}/1
      </div>

      <GameArea
        level={3}
        onComplete={handleComplete}
        onFail={handleFail}
        maxTasks={1}
      />

      <ToastLogger />

      {showCompletion && (
        <div className="fixed inset-0 flex justify-center items-center z-50 bg-black/90">
          <div className="bg-gray-900 rounded-xl p-8 border-4 border-yellow-400 text-center">
            <h2 className="text-2xl font-bold mb-4 text-white">
               All Levels Complete! 
            </h2>
            <p className="mb-6 text-white">
              Congratulations! You&rsquo;ve mastered all three levels of accessible
              computing training. You&rsquo;re now ready to use real software with eye
              blinks and head nods!
            </p>
            <div className="space-y-3">
              
              <button
                onClick={goToHome}
                className="block w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-500 transition"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
