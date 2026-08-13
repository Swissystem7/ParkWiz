module.exports = {
  formatDuration: function(mins) {
    if (mins < 60 && mins !== 15)
      return `${mins}ד'`;
    
    const h = Math.floor(mins / 60);
    let m = mins % 60;
    
    // Drop the minutes part when it's zero
    if (!m) {
      return `${h}ש'`;
    }
    
    return `${h}ש' ${m}ד'`;
  },
};