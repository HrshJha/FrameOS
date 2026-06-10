import type {
  AspectRatio,
  CameraMove,
  DurationSeconds,
  Scene,
  VideoScript,
} from "./types";

const DEFAULT_ASPECT_RATIO: AspectRatio = "9:16";
const STYLE_GUIDE =
  "cinematic realism, muted color palette, natural lensing, subtle film grain, photorealistic detail";

const sceneDurations: DurationSeconds[] = [8, 8, 8, 8, 8, 8];

const cameraText: Record<CameraMove, string> = {
  static: "locked static camera",
  slow_zoom_in: "slow zoom in",
  slow_zoom_out: "slow zoom out",
  pan_left: "smooth pan left",
  pan_right: "smooth pan right",
  tracking_shot: "tracking shot",
  aerial_descent: "aerial descent",
  handheld_follow: "handheld follow",
  dolly_forward: "dolly forward",
  orbit: "slow orbit",
};

interface SceneBlueprint {
  durationSeconds: DurationSeconds;
  cameraMovement: CameraMove;
  lighting: string;
  mood: string;
  audioNote: string;
  visual: (subject: string) => string;
  prompt: (subject: string, camera: string, lighting: string) => string;
}

const blueprints: SceneBlueprint[] = [
  {
    durationSeconds: sceneDurations[0],
    cameraMovement: "aerial_descent",
    lighting: "early morning haze with warm directional sunlight",
    mood: "expansive, anticipatory",
    audioNote: "low atmospheric pad with distant city ambience",
    visual: (subject) =>
      `A wide establishing view introduces ${subject} through a realistic location filled with relevant people, tools, screens, and physical details.`,
    prompt: (subject, camera, lighting) =>
      `Photorealistic documentary scene about ${subject}; a wide real-world location shows people, tools, screens, and physical details connected to ${subject}; ${camera}; ${lighting}; cinematic realism, muted palette, subtle film grain.`,
  },
  {
    durationSeconds: sceneDurations[1],
    cameraMovement: "dolly_forward",
    lighting: "soft window light with gentle practical highlights",
    mood: "focused, investigative",
    audioNote: "quiet room tone with restrained pulsing percussion",
    visual: (subject) =>
      `A focused operator studies physical notes, reference images, and production materials connected to ${subject} on a clean worktable.`,
    prompt: (subject, camera, lighting) =>
      `A focused operator studies notes, photos, diagrams, and production materials tied to ${subject} on a clean worktable; hands sort cards and mark details; ${camera}; ${lighting}; photorealistic cinematic style.`,
  },
  {
    durationSeconds: sceneDurations[2],
    cameraMovement: "tracking_shot",
    lighting: "cool overhead light balanced with warm practical lamps",
    mood: "precise, kinetic",
    audioNote: "steady mechanical rhythm with soft interface sounds",
    visual: (subject) =>
      `A production environment shows coordinated work around ${subject}, with monitors, equipment, and people moving through a detailed operational space.`,
    prompt: (subject, camera, lighting) =>
      `A detailed production space for ${subject} shows monitors, equipment, cables, props, and crew coordinating work in real time; people move with purpose; ${camera}; ${lighting}; cinematic realism, natural lensing.`,
  },
  {
    durationSeconds: sceneDurations[3],
    cameraMovement: "slow_zoom_in",
    lighting: "high contrast side light with controlled shadows",
    mood: "tense, concentrated",
    audioNote: "bass swell with subtle ticking texture",
    visual: (subject) =>
      `Close-up details reveal the critical decisions behind ${subject}: hands adjust equipment, annotate references, and compare results on a monitor.`,
    prompt: (subject, camera, lighting) =>
      `Close-up footage of ${subject} work in progress: hands adjust equipment, annotate printed references, compare results on a monitor, and arrange practical objects; ${camera}; ${lighting}; photorealistic film grain.`,
  },
  {
    durationSeconds: sceneDurations[4],
    cameraMovement: "orbit",
    lighting: "golden hour backlight with soft diffused fill",
    mood: "confident, revealing",
    audioNote: "music opens into a wider melodic cue",
    visual: (subject) =>
      `The finished visual system around ${subject} is revealed in a polished environment, showing scale, texture, and completed production assets.`,
    prompt: (subject, camera, lighting) =>
      `A polished environment reveals completed visual assets and practical results for ${subject}; screens show finished frames, printed boards line the walls, and crew review the output; ${camera}; ${lighting}; cinematic realism.`,
  },
  {
    durationSeconds: sceneDurations[5],
    cameraMovement: "slow_zoom_out",
    lighting: "blue hour ambient light with clean practical accents",
    mood: "resolved, cinematic",
    audioNote: "final sustained chord with soft environmental tail",
    visual: (subject) =>
      `A final wide shot shows ${subject} as a complete production-ready outcome, with the workspace quiet and the finished material visible.`,
    prompt: (subject, camera, lighting) =>
      `Final photorealistic wide shot for ${subject}; a quiet workspace displays finished material on screens and boards while soft practical lights glow around the room; ${camera}; ${lighting}; muted palette, subtle film grain.`,
  },
];

export function generateScript(topic: string): VideoScript {
  const subject = normalizeTopic(topic);
  const scenes = blueprints.slice(0, 6).map((blueprint, index): Scene => {
    const veoPrompt = compilePrompt(
      blueprint.prompt(subject, cameraText[blueprint.cameraMovement], blueprint.lighting),
    );

    return {
      sceneIndex: index,
      durationSeconds: blueprint.durationSeconds,
      visualDescription: blueprint.visual(subject),
      cameraMovement: blueprint.cameraMovement,
      lighting: blueprint.lighting,
      mood: blueprint.mood,
      audioNote: blueprint.audioNote,
      veoPrompt,
    };
  });

  return {
    title: makeTitle(subject),
    totalDurationSeconds: scenes.reduce(
      (total, scene) => total + scene.durationSeconds,
      0,
    ),
    aspectRatio: DEFAULT_ASPECT_RATIO,
    styleGuide: STYLE_GUIDE,
    scenes,
  };
}

function normalizeTopic(topic: string): string {
  const cleaned = topic
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\.$/, "");

  if (cleaned.length === 0) {
    throw new Error("Topic must not be empty.");
  }

  return limitWords(cleaned, 28);
}

function makeTitle(subject: string): string {
  const title = subject
    .split(" ")
    .map((word) => {
      if (word.length === 0) {
        return word;
      }

      return `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
    })
    .join(" ");

  return limitCharacters(`Cinematic ${title}`, 90);
}

function compilePrompt(prompt: string): string {
  const enhancedPrompt = `${prompt}; 8k resolution, highly detailed, professional cinematography, 35mm lens, sharp focus, hyperrealistic`;
  const compactPrompt = enhancedPrompt.replace(/\s+/g, " ").trim();

  if (compactPrompt.length <= 500) {
    return compactPrompt;
  }

  return limitCharacters(compactPrompt, 500);
}

function limitWords(value: string, maxWords: number): string {
  const words = value.split(" ").filter(Boolean);

  if (words.length <= maxWords) {
    return value;
  }

  return words.slice(0, maxWords).join(" ");
}

function limitCharacters(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const sliced = value.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace <= 0) {
    return sliced;
  }

  return sliced.slice(0, lastSpace);
}
