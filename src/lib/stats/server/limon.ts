// Funny, exaggerated stats for Limón the golden retriever.
// Some tied to real weather data, others randomly varied per page load.

interface LimonStat {
  label: string;
  value: string;
  icon: string;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1): string {
  return (Math.random() * (max - min) + min).toFixed(decimals);
}

export function generateLimonStats(outdoorTempF: number | null): LimonStat[] {
  const temp = outdoorTempF ?? 70;
  const isHot = temp > 80;
  const isWarm = temp > 70;
  const isCold = temp < 45;
  const isMild = temp >= 45 && temp <= 70;

  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth(); // 0-11
  const isSummer = month >= 5 && month <= 8;
  const isWinter = month <= 1 || month === 11;

  // Base stats that always show (pick 6-8 from pool)
  const pool: LimonStat[] = [
    // Always fun
    { label: 'Estimated tail wags today', value: `~${rand(8000, 22000).toLocaleString()}`, icon: '🐕' },
    { label: 'Good girl rating', value: `${rand(13, 15)}/10`, icon: '⭐' },
    { label: 'Squirrels spotted (est.)', value: `${rand(12, 67)}`, icon: '🐿️' },
    { label: 'Tennis balls currently lost', value: `${rand(3, 14)}`, icon: '🎾' },
    { label: 'Treats consumed (est.)', value: `${rand(4, 9)} today`, icon: '🦴' },
    { label: 'Belly rubs received', value: `${rand(6, 20)}`, icon: '🤲' },
    { label: 'Times asked to go outside', value: `${rand(5, 15)}`, icon: '🚪' },
    { label: 'Suspicious noises investigated', value: `${rand(8, 30)}`, icon: '🔍' },
    { label: 'Naps completed', value: `${rand(3, 8)}`, icon: '😴' },
    { label: 'Zoomie sessions', value: randFloat(1.5, 5.5), icon: '💨' },
    { label: 'Happiness level', value: `${rand(94, 100)}%`, icon: '🥰' },
    { label: 'Socks stolen', value: `${rand(0, 4)}`, icon: '🧦' },
    { label: 'Dream woofs (overnight)', value: `${rand(2, 12)}`, icon: '💤' },
    { label: 'Food bowl checks', value: `${rand(10, 35)}`, icon: '🍽️' },
    { label: 'Leaves chased', value: `${rand(0, 25)}`, icon: '🍂' },
  ];

  // Weather-dependent stats
  if (isHot) {
    pool.push(
      { label: 'Pool dip probability', value: `${rand(85, 99)}%`, icon: '🏊' },
      { label: 'Shade-seeking missions', value: `${rand(5, 12)}`, icon: '🌳' },
      { label: 'Water bowl refills demanded', value: `${rand(6, 15)}`, icon: '💧' }
    );
  } else if (isWarm) {
    pool.push(
      { label: 'Sunbathing minutes', value: `${rand(20, 90)}`, icon: '☀️' },
      { label: 'Outdoor adventure score', value: `${rand(85, 100)}/100`, icon: '🌿' }
    );
  } else if (isCold) {
    pool.push(
      { label: 'Blanket theft incidents', value: `${rand(3, 9)}`, icon: '🛏️' },
      { label: 'Refused to go outside', value: `${rand(2, 6)} times`, icon: '❄️' },
      { label: 'Couch hogging (hours)', value: randFloat(4, 10), icon: '🛋️' }
    );
  } else if (isMild) {
    pool.push(
      { label: 'Perfect walk weather enjoyment', value: `${rand(90, 100)}%`, icon: '🚶' }
    );
  }

  // Time-dependent
  if (hour < 8) {
    pool.push({ label: 'Breakfast countdown', value: 'URGENT', icon: '⏰' });
  } else if (hour >= 17 && hour < 20) {
    pool.push({ label: 'Dinner anticipation level', value: `${rand(95, 100)}%`, icon: '🍖' });
  } else if (hour >= 22) {
    pool.push({ label: 'Currently', value: 'Dreaming of treats', icon: '💭' });
  }

  // Season-dependent
  if (isSummer) {
    pool.push({ label: 'Sprinkler attacks', value: `${rand(2, 7)}`, icon: '💦' });
  }
  if (isWinter) {
    pool.push({ label: 'Snow taste tests', value: `${rand(10, 40)}`, icon: '❄️' });
  }

  // Shuffle and pick 8
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 8);
}
