"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GameArea from "@/components/GameArea";
import ToastLogger from "@/components/ToastLogger";

export default function Level2() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showCompletion, setShowCompletion] = useState<boolean>(false);

  // Restore completed status on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const c = localStorage.getItem("completedLevel2");
      const parsedStep = c ? parseInt(c, 10) : 0;
      setCurrentStep(isNaN(parsedStep) ? 0 : parsedStep);
    }
  }, []);

  function handleComplete() {
    // GameArea calls this only when ALL 3 tasks are completed
    setCurrentStep(3);
    localStorage.setItem("completedLevel2", "3");
    setShowCompletion(true);
  }

  function handleFail() {
    // Optionally reset or show a toast
  }

  function goToLevel3() {
    router.push("/level3");
  }

 

  return (
    <div className="bg-black h-screen w-full relative overflow-hidden">
      <div className="absolute top-4 left-8 text-lg z-10 text-white">
        Level 2: Complete 3 tasks (Moving cards)
      </div>
      <div className="absolute top-4 right-8 text-lg z-10 text-white">
        Progress: {currentStep}/3
      </div>

      <GameArea
        level={2}
        onComplete={handleComplete}
        onFail={handleFail}
        maxTasks={3}
      />

      <ToastLogger />

      {showCompletion && (
        <div className="fixed inset-0 flex justify-center items-center z-50 bg-black/90">
          <div className="bg-gray-900 rounded-xl p-8 border-4 border-green-400 text-center">
            <h2 className="text-2xl font-bold mb-4 text-white">
              Level 2 Complete!
            </h2>
            <p className="mb-6 text-white">
              Excellent! You&rsquo;ve mastered moving targets. Ready for the final
              challenge?
            </p>
            <div className="space-y-3">
              <button
                onClick={goToLevel3}
                className="block w-full px-6 py-3 bg-green-500 text-black rounded-lg font-bold hover:bg-green-400 transition"
              >
                Continue to Level 3
              </button>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
