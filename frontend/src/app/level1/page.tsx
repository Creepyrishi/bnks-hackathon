"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GameArea from "@/components/GameArea";
import ToastLogger from "@/components/ToastLogger";

export default function Level1() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showCompletion, setShowCompletion] = useState<boolean>(false);

  // Restore completed status on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const c = localStorage.getItem("completedLevel1");
      const parsedStep = c ? parseInt(c, 10) : 0;
      setCurrentStep(isNaN(parsedStep) ? 0 : parsedStep);
    }
  }, []);

  function handleComplete() {
    // GameArea calls this only when ALL 5 tasks are completed
    setCurrentStep(5);
    localStorage.setItem("completedLevel1", "5");
    setShowCompletion(true);
  }

  function handleFail() {
    // Optionally reset or show a toast
  }

  function goToLevel2() {
    router.push("/level2");
  }

  return (
    <div className="bg-black h-screen w-full relative overflow-hidden">
      <div className="absolute top-4 left-8 text-lg z-10 text-white">
        Level 1: Complete 5 tasks
      </div>
      <div className="absolute top-4 right-8 text-lg z-10 text-white">
        Progress: {currentStep}/5
      </div>

      <GameArea
        level={1}
        onComplete={handleComplete}
        onFail={handleFail}
        maxTasks={5}
      />

      <ToastLogger />

      {showCompletion && (
        <div className="fixed inset-0 flex justify-center items-center z-50 bg-black/90">
          <div className="bg-gray-900 rounded-xl p-8 border-4 border-green-400 text-center">
            <h2 className="text-2xl font-bold mb-4 text-white">
              Level 1 Complete!
            </h2>
            <p className="mb-6 text-white">
              Congratulations! You&rsquo;ve completed all 5 tasks in Level 1.
            </p>
            <div className="space-y-3">
              <button
                onClick={goToLevel2}
                className="block w-full px-6 py-3 bg-green-500 text-black rounded-lg font-bold hover:bg-green-400 transition"
              >
                Continue to Level 2
              </button>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
