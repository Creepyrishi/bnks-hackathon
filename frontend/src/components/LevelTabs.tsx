type Props = {
  level: number;
  setLevel: (l: number) => void;
  completed: number[];
};

export default function LevelTabs({ level, setLevel, completed }: Props) {
  return (
    <div className="flex justify-center items-center my-8">
      {[1, 2, 3].map((lvl) => (
        <button
          key={lvl}
          className={`mx-2 px-6 py-2 rounded-full font-semibold transition
            ${level === lvl ? 'bg-white text-black' : 'bg-gray-800 text-gray-200'}
            ${completed.includes(lvl) ? 'border border-green-500' : ''}`}
          onClick={() => setLevel(lvl)}
          disabled={lvl > completed.length + 1}
        >
          Level {lvl}
        </button>
      ))}
    </div>
  );
}
