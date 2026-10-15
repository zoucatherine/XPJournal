import smile from "../../../assets/emoticons/smile.png";
import happy from "../../../assets/emoticons/open-mouthed-smile.png";
import heart from "../../../assets/emoticons/red-heart.png";
import cool from "../../../assets/emoticons/hot-smile.png";
import party from "../../../assets/emoticons/party-smile-static.png";
import relaxed from "../../../assets/emoticons/embarrassed-smile.png";
import neutral from "../../../assets/emoticons/thinking-smile-static.png";
import disappointed from "../../../assets/emoticons/disappointed-smile.png";
import crying from "../../../assets/emoticons/crying-face-static.png";
import angry from "../../../assets/emoticons/angry-smile.png";
import sleepy from "../../../assets/emoticons/sleepy-smile-static.png";
import sick from "../../../assets/emoticons/sick-smile.png";
import celebration from "../../../assets/emoticons/birthday-cake-static.png";
import confident from "../../../assets/emoticons/thumbs-up.png";
import grateful from "../../../assets/emoticons/angel.png";

// Keep the saved values unchanged so existing entries need no migration.
// Static images are intentional: the supplied PNG sheets are not icons.
export const MOODS = [
  { value: "😊", label: "Happy", src: smile },
  { value: "😄", label: "Very happy", src: happy },
  { value: "😍", label: "Loved", src: heart },
  { value: "😎", label: "Cool", src: cool },
  { value: "🥳", label: "Excited", src: party },
  { value: "😌", label: "Content", src: relaxed },
  { value: "😐", label: "Neutral", src: neutral },
  { value: "😔", label: "Disappointed", src: disappointed },
  { value: "😢", label: "Sad", src: crying },
  { value: "😠", label: "Angry", src: angry },
  { value: "😴", label: "Sleepy", src: sleepy },
  { value: "🤒", label: "Unwell", src: sick },
  { value: "🎉", label: "Celebrating", src: celebration },
  { value: "💪", label: "Confident", src: confident },
  { value: "🙏", label: "Grateful", src: grateful },
] as const;

export function moodLabel(value: string) {
  return MOODS.find(mood => mood.value === value)?.label ?? "Unrecognized saved mood";
}

export function MoodIcon({ mood }: { mood: string }) {
  const icon = MOODS.find(option => option.value === mood);
  if (!icon) return <span title="Unrecognized saved mood" aria-label="Unrecognized saved mood">?</span>;
  return (
    <img
      src={icon.src}
      alt={icon.label}
      width={19}
      height={19}
      draggable={false}
      style={{ display: "inline-block", width: 19, height: 19, verticalAlign: "middle", imageRendering: "pixelated" }}
    />
  );
}
