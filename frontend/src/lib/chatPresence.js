export function getPresenceMeta(status) {
  if (status === "online") return { label: "Online", dotClassName: "bg-emerald-500" };
  if (status === "away") return { label: "Away", dotClassName: "bg-amber-400" };
  return { label: "Offline", dotClassName: "bg-[#bcc0c4]" };
}

export function getPresenceDotClassName(status) {
  if (status === "online") return "bg-emerald-500";
  if (status === "away") return "bg-amber-400";
  return "bg-[#bcc0c4]";
}
