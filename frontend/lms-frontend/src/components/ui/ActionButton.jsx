import { motion } from "framer-motion";

const MotionButton = motion.button;

export default function ActionButton({
  children,
  type = "button",
  tone = "secondary",
  className = "",
  animate = false,
  ...props
}) {
  const tones = {
    primary: "border-blue-500 bg-blue-500 text-white hover:bg-blue-600 hover:border-blue-600",
    secondary: "border-slate-300 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50",
    ghost: "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200",
    danger: "border-red-300 bg-white text-red-700 hover:bg-red-50",
    solidDanger: "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600",
    success: "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-black hover:border-black",
  };

  const Comp = animate ? MotionButton : "button";

  return (
    <Comp
      type={type}
      className={`action-button action-button-${tone} inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone] || tones.secondary} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}
