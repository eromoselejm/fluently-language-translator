export default function formatSavedTime(time) {
    const timeNow = Date.now();
    const MS_PER_MINUTE = 60000
    const MS_PER_HOUR   = 3600000
    const MS_PER_DAY    = 86400000
    const MS_PER_YEAR   = 31557600000  
    
    const diff = timeNow - time;

    const minutes = Math.floor(diff / MS_PER_MINUTE);
    const hours = Math.floor(diff / MS_PER_HOUR);
    const days = Math.floor(diff / MS_PER_DAY);
    const years = Math.floor(diff / MS_PER_YEAR);

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours < 24) return `${hours} hrs ago`;
    if (days < 30) return `${days} days ago`;
    if (years < 1) return `${years} years ago`;
    
}