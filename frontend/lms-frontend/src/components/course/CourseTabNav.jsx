import { motion } from "framer-motion";

const MotionButton = motion.button;

export default function CourseTabNav({ tabs, activeTab, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <MotionButton
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
            className={[
              "relative overflow-hidden rounded-xl border px-5 py-2.5 text-sm font-semibold shadow-sm transition",
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50",
            ].join(" ")}
          >
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-300" /> : null}
            <span className="relative">{tab.label}</span>
          </MotionButton>
        );
      })}
    </div>
  );
}
