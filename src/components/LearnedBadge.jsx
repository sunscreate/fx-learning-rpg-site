export default function LearnedBadge({
  learned,
}) {

  if (!learned) {
    return null;
  }

  return (
    <div className="learned-badge">
      ✅ QUEST CLEAR 済み
    </div>
  );
}
