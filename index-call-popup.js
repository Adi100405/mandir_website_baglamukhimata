function openCallPopup(){
  const o=document.getElementById('callPopup');
  const b=document.getElementById('callPopupBox');
  o.style.display='flex';
  requestAnimationFrame(()=>{ b.style.transform='scale(1)'; b.style.opacity='1'; });
}
function closeCallPopup(){
  const o=document.getElementById('callPopup');
  const b=document.getElementById('callPopupBox');
  b.style.transform='scale(0.85)'; b.style.opacity='0';
  setTimeout(()=>o.style.display='none',300);
}
document.getElementById('callPopup').addEventListener('click',function(e){ if(e.target===this) closeCallPopup(); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeCallPopup(); });
