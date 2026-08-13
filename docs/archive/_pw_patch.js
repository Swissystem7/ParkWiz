const fs=require('fs');const p='index.html';let s=fs.readFileSync(p,'utf8');
const a='מבוסס על ${spotsNow + 4} דיווחי קהילה + ${pangoNum} אירועי פנגו + דפוסי שעה';
const b='מבוסס על דפוסי-שעה + חיזוי הסתברותי · הערכה בלבד, לא מלאי מובטח';
if(!s.includes(a)){console.log('A_NOT_FOUND');process.exit(1);}
s=s.replace(a,b);
const c="  const spotsNow = Math.round(s.avail/100 * (8 + Math.floor(Math.random()*6)));";
if(!s.includes(c)){console.log('C_NOT_FOUND');process.exit(1);}
s=s.replace(c,"  // הוסר מונה קהילה מדומה (Math.random) - נשאר commCount אמיתי + חיזוי הסתברותי");
fs.writeFileSync(p,s);
console.log('OK bytes',s.length);
