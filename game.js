(function(){
"use strict";
var cv=document.getElementById("game"),cx=cv.getContext("2d");
var DPR=Math.min(window.devicePixelRatio||1,2);
var VW=360,VH,SC;
function resize(){
  var W=window.innerWidth,oldH=window.innerHeight;
  if(window.visualViewport){
    W=window.visualViewport.width;oldH=window.visualViewport.height;
  }
  var H=oldH;
  cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+"px";cv.style.height=H+"px";
  SC=W/VW;VH=H/SC;
}
window.addEventListener("resize",resize);
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",resize);
  window.visualViewport.addEventListener("scroll",resize);
}
window.addEventListener("orientationchange",resize);
resize();
var TAU=Math.PI*2,now=0,t0=0;

// ---------- Audio ----------
var AC=null;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}return AC;}
function tone(f,d,type,vol,slide){
  var a=ac();if(!a)return;
  var o=a.createOscillator(),g=a.createGain();
  o.type=type||"sine";o.frequency.setValueAtTime(f,a.currentTime);
  if(slide)o.frequency.linearRampToValueAtTime(Math.max(20,f+slide),a.currentTime+d);
  g.gain.setValueAtTime(vol||0.12,a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+d);
  o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d+0.02);
}
function sJump(){tone(280,0.18,"sine",0.12,500);}
function sLand(){tone(480,0.1,"triangle",0.1,-320);}
function sStar(){tone(880,0.12,"sine",0.14,400);setTimeout(function(){tone(1320,0.15,"sine",0.1,500);},60);}
function sPerfect(){tone(660,0.14,"sine",0.12,400);setTimeout(function(){tone(990,0.16,"sine",0.1,300);},60);setTimeout(function(){tone(1320,0.2,"sine",0.08,400);},120);}
function sDie(){tone(500,0.35,"sawtooth",0.1,-380);}

// ---------- Player & world ----------
var G=null;
function newGame(){
  var groundY=360; // world y of the solid ground the unicorn stands on
  G={x:VW/2,y:groundY,vx:0,vy:0,grounded:true,dead:false,over:false,started:false,
    menu:true,aiming:false,power:0,aimX:0,aimY:0,armed:false,drag:{x:0,y:0},dragON:false,
    camX:0,camY:0,height:0,stars:0,best:+(localStorage.getItem("upcornBest")||0),
    combos:0,landFlash:0,sx:0,sy:0,slide:0,lastDir:0,lastAimX:0,t:Math.random()*999,blink:0,
    platforms:[],nextId:1,topY:groundY,star:[],part:[],shake:0,lastPf:0,lastPfX:0,
    everJumped:false,mil:0,milT:-9,milV:0,groundY:groundY};
  // solid ground platform spanning the screen
  G.platforms.push({x:0,y:groundY,w:VW,type:0,a:0,d:0,base:0,t:0});
  // camera keeps player near the bottom on the ground, easing up as they climb
  G.camY=groundY-VH*followK(0);
  G.lastPf=0;G.lastPfX=0;G.camX=VW/2-VW/2;
  gen();
}

function clamp(v,a,b){return v<a?a:(v>b?b:v);}
// on-screen fraction (0..1) for the player: ~0.72 near the ground (fills the screen),
// easing to ~0.40 once you're high so you can see the climb ahead
function followK(alt){
  var a=alt/1000;if(a>1)a=1;
  return 0.84-0.40*a;
}

// ---------- Generation ----------
function gen(){
  var guard=0;
  while(G.topY>G.camY-VH*3.2&&guard++<80){
    var prev=G.platforms[G.platforms.length-1];
    if(!prev)break;
    var d=1+Math.min(1.1,(-prev.y)/1000); // difficulty 1->2.1
    var gap=40+Math.random()*16*d;
    var ny=prev.y-gap;
    var nw=Math.max(46,130-(Math.random()*34+12)*d+ (Math.random()<0.12?25:0));
    var nx=clamp(prev.x+(Math.random()*2-1)*60*d,20,VW-20-nw);
    var type=0;
    if(d>1.2&&Math.random()<0.16*d-0.15)type=1;
    if(Math.random()<0.08)type=3;
    var p={x:nx,y:ny,w:nw,type:type,a:type===1?(40+Math.random()*30)*(Math.random()<0.5?-1:1):0,
           base:nx,t:Math.random()*999,d:type===1?(Math.random()<0.5?-1:1):0};
    G.platforms.push(p);
    if(Math.random()<0.75){
      G.star.push({x:nx+Math.random()*Math.max(8,nw-20),y:ny-42,r:7,
        sX:(Math.random()*2-1)*40,sY:-18,va:(Math.random()*2-1)*2,id:G.nextId++});
    }
    G.topY=ny;
  }
}
function prune(){
  while(G.platforms.length>2&&G.platforms[0].y>G.camY+VH*4+200)G.platforms.shift();
  if(G.star.length)G.star=G.star.filter(function(s){return s.y<G.camY+VH*4+200;});
}

// ---------- Input ----------
function evPt(e){
  var r=cv.getBoundingClientRect();
  return{x:(e.clientX-r.left)/SC,y:(e.clientY-r.top)/SC};
}
function begin(){
  if(!G)return;
  G.menu=false;G.started=true;G.everJumped=false;
}
function down(e){
  var a=ac();if(a&&a.state==="suspended")a.resume();
  if(G.over){if(now-G.overAt>0.6&&inRetry(e))retry();return;}
  if(G.menu){begin();return;}
  if(G.dead)return;
  if(G.grounded){var p=evPt(e);G.drag={x:p.x,y:p.y};G.dragON=true;G.aiming=true;G.power=0;G.aimX=0;G.aimY=0;G.armed=false;G.armedAt=-9;}
}
function move(e){
  if(!G||!G.dragON||!G.aiming)return;
  var p=evPt(e),dx=p.x-G.drag.x,dy=p.y-G.drag.y;
  var len=Math.min(1,Math.hypot(dx,dy)/(VH*0.3));
  if(len<0.03)return;
  var a=Math.atan2(dy,dx);
  G.aimX=-Math.cos(a);G.aimY=-Math.sin(a);G.power=len;G.armed=true;G.armedAt=now;
}
function up(e){
  if(!G)return;
  if(G.dead){G.dragON=false;G.aiming=false;G.armed=false;return;}
  // only launch from a fresh grounded drag that actually moved this gesture
  if(G.armed&&now-G.armedAt<0.2&&G.power>0.12){
    var p=G.power,V=940*p;
    G.vx=G.aimX*V;G.vy=G.aimY*V;
    if(-G.vy<260)G.vy=-260;
    G.grounded=false;G.combos=0;G.everJumped=true;
    G.lastAimX=G.aimX;G.lastDir=G.aimX>0.05?1:(G.aimX<-0.05?-1:0);
    G.sx=-0.6;G.sy=0.2;
    burst(G.x,G.y+5,10);
    sJump();
  }
  G.dragON=false;G.aiming=false;G.armed=false;G.power=0;
}
function inRetry(e){
  var p=evPt(e);
  return Math.abs(p.x-VW/2)<VW*0.2&&Math.abs(p.y-(VH/2+20))<VH*0.07;
}
function retry(){newGame();begin();}
cv.addEventListener("pointerdown",down);
function cancel(e){if(G){G.dragON=false;G.aiming=false;G.armed=false;G.power=0;}}
window.addEventListener("pointermove",move);
window.addEventListener("pointerup",up);
window.addEventListener("pointercancel",cancel);
window.addEventListener("blur",cancel);
cv.style.touchAction="none";

// ---------- Physics ----------
function step(){
  var p=G;if(!p||p.over)return;
  if(p.menu){
    p.t+=DT;
    p.blink=Math.max(0,p.blink-DT);
    if(Math.random()<0.004)p.blink=0.14;
    p.sx+=(0-p.sx)*Math.min(1,DT*7);
    p.sy+=(0-p.sy)*Math.min(1,DT*7);
    // keep clouds drifting (follow leaves the player low on screen when near the ground)
    var tyi=p.y-VH*followK(p.height,G.groundY-p.y);
    p.camY+=(tyi-p.camY)*Math.min(1,DT*8);
    return;
  }
  // can't launch while airborne (clears any stale armed gesture)
  if(!p.grounded&&p.armed)p.armed=false;
  // a drag that isn't followed by a release within 0.28s is stale — disarm it
  if(p.armed&&now-p.armedAt>0.28)p.armed=false;
  // air control: aim while airborne nudges vx (bounded so a stuck drag can't runaway)
  if(!p.grounded&&p.dragON){p.vx+=p.aimX*1500*DT;if(p.vx>520)p.vx=520;if(p.vx<-520)p.vx=-520;}
  p.vy+=1500*DT;
  p.x+=p.vx*DT;p.y+=p.vy*DT;
  if(p.x<10){p.x=10;p.vx=Math.abs(p.vx)*0.5;}
  if(p.x>VW-10){p.x=VW-10;p.vx=-Math.abs(p.vx)*0.5;}
  // moving platforms
  for(var i=0;i<p.platforms.length;i++){var pf=p.platforms[i];
    if(pf.type===1)pf.x=pf.base+Math.sin(pf.t+now)*pf.a;
  }
  // ride moving platform while grounded
  if(p.grounded&&p.lastPf>=0&&p.lastPf<p.platforms.length){
    var pf=p.platforms[p.lastPf];
    p.x+=pf.x-p.lastPfX;p.lastPfX=pf.x;
  }
  // landing (swept: catches platforms even at high fall speed)
  if(!p.grounded){
    var prevY=p.y-p.vy*DT;
    for(var i=0;i<p.platforms.length;i++){var pf=p.platforms[i];
      if(p.x>pf.x&&p.x<pf.x+pf.w&&p.vy>=0&&p.y>=pf.y&&prevY<=pf.y+6){
        p.y=pf.y;p.vy=0;p.grounded=true;p.lastPf=i;p.lastPfX=pf.x;
        p.sx=0.5;p.sy=-0.15;
        p.slide=p.lastAimX*170;
        sLand();
        p.combos++;
        if(pf.type===3){p.stars++;p.landFlash=0.5;sPerfect();burst(p.x,pf.y-6,16);}
        break;
      }
    }
  }
  // collect stars
  for(var i=p.star.length-1;i>=0;i--){var s=p.star[i];
    s.x+=s.sX*DT;s.y+=s.sY*DT;
    var dx=p.x-s.x,dy=p.y-15-s.y;
    if(dx*dx+dy*dy<900){p.stars++;p.star.splice(i,1);sStar();burst(s.x,s.y,8);}
  }
  // keep the user grounded: feet pinned to the platform top, no vy/y sink
  if(p.grounded)p.vx=0;
  if(p.grounded&&p.slide){ // forward "bounce" in the jump direction, with friction
    p.x+=p.slide*DT;
    p.slide-=Math.sign(p.slide)*260*DT;if(Math.abs(p.slide)<12)p.slide=0;
    if(p.x<8){p.x=8;p.slide=Math.abs(p.slide)*0.4;}
    if(p.x>VW-8){p.x=VW-8;p.slide=-Math.abs(p.slide)*0.4;}
  }
  if(p.grounded&&p.lastPf>=0&&p.lastPf<p.platforms.length&&p.platforms[p.lastPf].y<=p.y){
    p.y=p.platforms[p.lastPf].y;p.vy=0;
  }
  // camera — player sits low on screen near the ground, eases up as you climb
  var tx=clamp(p.x-VW/2,0,VW*3);
  p.camX+=(tx-p.camX)*Math.min(1,DT*6);
  var ty=p.y-VH*followK(p.height,p.groundY-p.y);
  p.camY+=(ty-p.camY)*Math.min(1,DT*8);
  // height + milestones (above the ground)
  var hgt=G.groundY-p.y;
  if(hgt>p.height)p.height=hgt;
  var hm=Math.floor(p.height/10);
  var ms=[100,500,1000,2500,5000,10000];
  while(p.mil<ms.length&&hm>=ms[p.mil]){
    p.milV=ms[p.mil];p.milT=now;sPerfect();p.mil++;
  }
  // particles
  for(var i=p.part.length-1;i>=0;i--){var q=p.part[i];
    q.vy+=500*DT;q.x+=q.vx*DT;q.y+=q.vy*DT;q.l-=DT;
    if(q.l<=0)p.part.splice(i,1);
  }
  p.sx+=(0-p.sx)*Math.min(1,DT*7);
  p.sy+=(0-p.sy)*Math.min(1,DT*7);
  p.blink=Math.max(0,p.blink-DT);
  if(Math.random()<0.003)p.blink=0.14;
  p.landFlash=Math.max(0,p.landFlash-DT);
  p.shake=Math.max(0,p.shake-DT*3);
  p.t+=DT;
  // death fall
  if(p.y>p.camY+VH+50){die();return;}
  // generation
  if(G.topY>G.camY-VH*3.2){gen();}
  prune();
}
function die(){
  var p=G;
  p.dead=true;p.shake=0.7;sDie();burst(p.x,p.y,20);
  if(Math.floor(p.height/10)>p.best){p.best=Math.floor(p.height/10);localStorage.setItem("upcornBest",String(p.best));}
  p.overAt=now;
  p.over=true;
}
var DT=1/60;

// ---------- Particles ----------
var PC=["#ff6b9d","#ffd166","#7ee0ff","#c77dff","#a3ff8e"];
function burst(x,y,n){
  for(var i=0;i<n&&G.part.length<250;i++){
    G.part.push({x:x,y:y,vx:(Math.random()*2-1)*180,vy:-Math.random()*200-40,l:0.5+Math.random()*0.5,c:PC[(Math.random()*PC.length)|0],r:2+Math.random()*3});
  }
}

// ---------- Primitives ----------
function blob(x,y,r,f){cx.fillStyle=f;cx.beginPath();cx.arc(x,y,r,0,TAU);cx.fill();}
function rr(x,y,w,h,r){cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath();}

// ---------- Unicorn ----------
function drawUnicorn(){
  var p=G;
  var px=p.x-p.camX,py=p.y-p.camY;
  var wob=Math.sin(p.t*2)*1.5;
  cx.save();
  // squash & stretch (sprite drawn so p.y == the unicorn's feet)
  var sq=Math.max(0.55,1-p.sx*0.7+(p.aiming?0.25:0));
  cx.translate(px,py-7);
  cx.scale(1/sq,sq);
  var y0=-12+wob*(p.grounded?1:0.3);
  // tail
  cx.fillStyle="#ff9ecb";
  cx.save();cx.translate(-11,y0-6);cx.rotate(0.7+Math.sin(p.t*3)*0.25*(p.grounded?1:0.4));
  cx.beginPath();cx.moveTo(0,0);
  cx.quadraticCurveTo(-7,-6,-9,-14);cx.quadraticCurveTo(-4,-10,0,-2);cx.closePath();cx.fill();cx.restore();
  // mane
  cx.fillStyle="#ffcfe8";
  cx.beginPath();cx.moveTo(8,y0-16);
  cx.quadraticCurveTo(20,y0-28+Math.sin(p.t*5)*2,13,y0-10);
  cx.quadraticCurveTo(22,y0-20+Math.sin(p.t*5+1)*2,15,y0-2);
  cx.closePath();cx.fill();
  // hind leg
  leg(-9,-6+ y0+6,1);
  // body
  blob(0,y0+4,17,"#fff3fb");blob(4,y0,16,"#fff9fd");
  // front leg
  leg(6,y0+6,-1);
  // ears
  blob(-9,y0-22,4.5,"#ffcfe8");blob(-10,y0-25,2.5,"#ff9ecb");
  blob(8,y0-24,4.5,"#ffcfe8");blob(9,y0-27,2.5,"#ff9ecb");
  // head
  blob(7,y0-14,14,"#ffffff");
  // horn
  cx.fillStyle="#ffe9a3";
  cx.beginPath();cx.moveTo(5,y0-26);cx.lineTo(11,y0-50+Math.sin(p.t*5)*1);cx.lineTo(14,y0-24);cx.closePath();cx.fill();
  cx.fillStyle="#fff7d6";
  cx.beginPath();cx.moveTo(7,y0-30);cx.lineTo(10,y0-42);cx.lineTo(12,y0-28);cx.closePath();cx.fill();
  if(Math.random()<0.05)blob(11,y0-50,1.5,"#fff");
  // eyes
  var ex=4,ey=y0-15;
  if(p.blink>0){blob(ex+2,ey,2,"#3a2a45");blob(10,ey,2,"#3a2a45");}
  else{
    blob(ex,ey,3,"#3a2a45");blob(ex+1.2,ey-1,1.2,"#fff");
    blob(10,ey,3,"#3a2a45");blob(11.2,ey-1,1.2,"#fff");
  }
  // muzzle
  blob(17,y0-8,5,"#fff0f8");blob(19,y0-7,2.6,"#ffc6dd");
  // cheeks
  blob(5,y0-3,3,"#ffd1e8");
  // horn sparkle
  if(Math.sin(p.t*6)>0.7)blob(13+Math.sin(p.t*9)*5,y0-46,1.8,"#ffe9a3");
  cx.restore();
}
function leg(lx,ly,dir){
  cx.fillStyle="#fbf0f7";
  cx.beginPath();cx.ellipse(lx+dir*3,ly+5,4.5,8,0,0,TAU);cx.fill();
  cx.fillStyle="#ecc8e6";
  cx.beginPath();cx.ellipse(lx+dir*2.5,ly+10,4.5,3,0,0,TAU);cx.fill();
}

// ---------- Platforms ----------
var RCB=["#ff5c8a","#ff9f43","#ffd93d","#6ad66a","#4aa8ff","#b06bff"];
function drawPlatform(pf){
  var x=pf.x-G.camX;
  var y=pf.y-G.camY;
  if(y<-40||y>VH+40)return;
  var n=Math.max(3,Math.round(pf.w/9)),seg=pf.w/n;
  for(var i=0;i<n;i++){
    cx.fillStyle=RCB[i%RCB.length];
    rr(x+i*seg-1,y-4,seg+2,9,4);cx.fill();
  }
  cx.fillStyle="rgba(255,255,255,0.9)";
  rr(x,y-7,pf.w,5,2.5);cx.fill();
  // puff
  var fl=(now*1.2)%pf.w;
  blob(x+fl,y-10,2.5,"rgba(255,255,255,0.7)");
  if(pf.type===3){blob(x+pf.w/2,y-9,6,"#ffd77a");blob(x+pf.w/2-7,y-6,4,"#ffc24a");blob(x+pf.w/2+7,y-6,4,"#ffc24a");}
}

// ---------- Stars ----------
function drawStar(s){
  var x=s.x-G.camX,y=s.y-G.camY;
  if(y<-20||y>VH+20)return;
  var a=now*4+s.va;
  y+=Math.sin(a)*3;
  cx.save();cx.translate(x,y);cx.rotate(a);
  blob(0,0,10,"rgba(255,224,102,0.22)");
  starPath(0,0,7);
  cx.fillStyle="#ffe066";cx.fill();cx.restore();
}
function starPath(px,py,r){
  cx.beginPath();
  for(var i=0;i<10;i++){
    var rad=i%2?r*0.42:r;
    var a=i*Math.PI/5-Math.PI/2;
    var x=px+Math.cos(a)*rad,y=py+Math.sin(a)*rad;
    if(i===0)cx.moveTo(x,y);else cx.lineTo(x,y);
  }
  cx.closePath();
}

// ---------- Clouds ----------
var clouds=[];
(function(){for(var i=0;i<9;i++)clouds.push({x:Math.random()*VW,y:Math.random()*VH,s:0.5+Math.random()*1.1,v:Math.random()*6+3,par:0.5+Math.random()*0.5});})();
function drawBG(){
  var h=Math.min(1,G.height/3000);
  var g=cx.createLinearGradient(0,0,0,VH);
  g.addColorStop(0,mix("#3a1b6e","#1a0b36",1-h*0.6));
  g.addColorStop(0.4,mix("#5b2c8a","#2a1460",h));
  g.addColorStop(0.75,mix("#8a5fd0","#7ec8ff",h));
  g.addColorStop(1,mix("#ffc6dd","#bfe8ff",h));
  cx.fillStyle=g;cx.fillRect(0,0,VW,VH);
  for(var i=0;i<clouds.length;i++){var c=clouds[i];
    c.x+=c.v*DT;if(c.x>VW+60)c.x=-60;
    var cy=((c.y-G.camY*c.par*0.25)%(VH+120)+VH+120)%(VH+120)-60;
    drawCloud(c.x-G.camX*0.18*c.par,cy,c.s);
  }
  if(h>0.35){
    cx.fillStyle="rgba(255,255,255,"+((h-0.35)*1.1)+")";
    for(var i=0;i<26;i++){
      var tx=(i*71)%VW,ty=(i*137)%(VH*0.7);
      if(Math.sin(now*6+i*1.3)>0.5)blob(tx,ty,1.3,"rgba(255,255,255,0.8)");
    }
  }
}
function drawCloud(x,y,s){
  cx.globalAlpha=0.5;blob(x,y,15*s,"#ffffff");blob(x+13*s,y+4,11*s,"#ffffff");
  blob(x-13*s,y+4,11*s,"#ffffff");blob(x+6*s,y-6,10*s,"#ffffff");blob(x-6*s,y-6,10*s,"#ffffff");
  cx.globalAlpha=1;
}
function mix(a,b,t){
  var A=hex(a),B=hex(b),o=[0,1,2].map(function(i){return Math.round(A[i]+(B[i]-A[i])*t);});
  return "rgb("+o.join(",")+")";
}
function hex(h){return[parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];}

// ---------- Aim trajectory ----------
function drawAim(){
  var p=G;if(!p.aiming)return;
  var V=940*p.power,vx0=p.aimX*V,vy0=p.aimY*V;
  var ax=p.x,ay=p.y+6;
  for(var i=1;i<13;i++){
    var st=i*0.026;
    var x=ax+vx0*st, y=ay+vy0*st+0.5*1500*st*st;
    var sx=x-p.camX,sy=y-p.camY;
    if(sy<-20||sy>VH)break;
    var al=1-i/13;
    blob(sx,sy,2.4*(al+0.2),"rgba(255,255,255,"+al+")");
  }
}

// ---------- UI ----------
function drawUI(){
  cx.textAlign="center";cx.textBaseline="top";
  var ht=Math.max(0,Math.floor(G.height/10));
  cx.font="800 "+Math.round(36*SC)+"px system-ui";
  cx.lineWidth=Math.round(5*SC);
  cx.strokeStyle="rgba(40,20,80,0.6)";
  var top=14*SC;
  cx.strokeText(ht+"m",VW/2,top);
  cx.fillStyle="#fff";cx.fillText(ht+"m",VW/2,top);
  cx.textAlign="right";
  cx.strokeText("★ "+G.stars,VW-14*SC,top);
  cx.fillStyle="#ffe066";cx.fillText("★ "+G.stars,VW-14*SC,top);
  cx.textAlign="center";
}

// ---------- Game over ----------
function drawOver(){
  var p=G,a=Math.min(1,(now-p.overAt)/0.4);
  cx.fillStyle="rgba(24,10,44,"+(0.55*a)+")";cx.fillRect(0,0,VW,VH);
  cx.globalAlpha=a;
  cx.textAlign="center";cx.textBaseline="middle";
  cx.font="800 "+Math.round(42*SC)+"px system-ui";cx.fillStyle="#fff";
  cx.fillText("So fluffy!",VW/2,VH/2-150*SC);
  cx.font="700 "+Math.round(28*SC)+"px system-ui";cx.fillStyle="#ffe066";
  cx.strokeStyle="rgba(40,20,80,0.6)";cx.lineWidth=4;
  var line3=Math.max(0,Math.floor(p.height/10))+"m  •  ★ "+p.stars;
  cx.strokeText(line3,VW/2,VH/2-100*SC);cx.fillText(line3,VW/2,VH/2-100*SC);
  cx.font="700 "+Math.round(18*SC)+"px system-ui";cx.fillStyle="rgba(255,255,255,0.8)";
  cx.fillText("BEST "+Math.max(p.best,Math.floor(p.height/10))+"m",VW/2,VH/2-60*SC);
  var by=VH/2+20,bw=160*SC,bh=54*SC;
  cx.fillStyle="#ff5c8a";rr(VW/2-bw/2,by-bh/2,bw,bh,26*SC);cx.fill();
  cx.strokeStyle="#fff";cx.lineWidth=3;rr(VW/2-bw/2,by-bh/2,bw,bh,26*SC);cx.stroke();
  cx.fillStyle="#fff";cx.font="800 "+Math.round(22*SC)+"px system-ui";
  cx.fillText("Go again!",VW/2,by);
  cx.globalAlpha=1;
}

// ---------- Hints & milestones ----------
function drawHints(){
  var p=G;
  cx.textAlign="center";cx.textBaseline="middle";
  if(!p.everJumped&&!p.dead){
    var fl=0.7+Math.sin(p.t*3)*0.3;
    cx.globalAlpha=fl;
    cx.font="700 "+Math.round(16*SC)+"px system-ui";cx.fillStyle="#fff";
    cx.strokeStyle="rgba(40,20,80,0.7)";cx.lineWidth=4;
    var ty=VH/2+62*SC,ax=VW/2+Math.sin(now*2)*16;
    cx.strokeText("Pull down, then release to jump!",VW/2,ty);
    cx.fillText("Pull down, then release to jump!",VW/2,ty);
    cx.strokeStyle="#fff";
    cx.beginPath();cx.moveTo(ax,ty-14*SC);cx.lineTo(ax-5*SC,ty-6*SC);
    cx.moveTo(ax,ty-14*SC);cx.lineTo(ax+5*SC,ty-6*SC);
    cx.moveTo(ax,ty-14*SC);cx.lineTo(ax,ty+10*SC);
    cx.stroke();
    cx.globalAlpha=1;
  }
  if(p.milT>-1&&now-p.milT<1.6){
    var a=Math.min(1,(now-p.milT)*2);
    var oy=(1-a)*20*SC;
    cx.globalAlpha=a;
    cx.font="800 "+Math.round(30*SC)+"px system-ui";cx.fillStyle="#ffd166";
    cx.strokeStyle="rgba(40,20,80,0.7)";cx.lineWidth=5;
    var v=p.milV,m="— "+(v>=1000?(v/1000).toFixed(1)+"km":v+"m")+" —";
    cx.strokeText(m,VW/2,VH*0.2+oy);cx.fillText(m,VW/2,VH*0.2+oy);
    cx.globalAlpha=1;
  }
}

// ---------- Menu ----------
function drawMenu(){
  cx.textAlign="center";cx.textBaseline="middle";
  var yc=VH*0.30;
  cx.globalAlpha=0.95;
  cx.font="900 "+Math.round(62*SC)+"px system-ui";
  cx.fillStyle="#ffffff";
  cx.strokeStyle="#ff5c8a";cx.lineWidth=Math.round(8*SC);
  cx.strokeText("UPCORN",VW/2,yc);
  cx.fillText("UPCORN",VW/2,yc);
  cx.font="700 "+Math.round(18*SC)+"px system-ui";
  cx.fillStyle="#ffd166";cx.strokeStyle="rgba(40,20,80,0.6)";cx.lineWidth=4;
  cx.strokeText("climb the rainbow tower",VW/2,yc+40*SC);
  cx.fillText("climb the rainbow tower",VW/2,yc+40*SC);
  var fl=0.6+Math.sin(now*3)*0.4;
  cx.globalAlpha=fl;
  cx.font="800 "+Math.round(24*SC)+"px system-ui";
  cx.fillStyle="#ffffff";cx.strokeStyle="rgba(40,20,80,0.7)";cx.lineWidth=5;
  var ty=VH*0.86;
  cx.strokeText("TAP TO START",VW/2,ty);
  cx.fillText("TAP TO START",VW/2,ty);
  cx.globalAlpha=1;
  // small hint
  cx.font="600 "+Math.round(14*SC)+"px system-ui";
  cx.fillStyle="rgba(255,255,255,0.75)";
  cx.fillText("pull down · release · fly up",VW/2,ty+30*SC);
}

// ---------- Render ----------
function render(){
  cx.setTransform(DPR*SC,0,0,DPR*SC,0,0);
  cx.clearRect(0,0,VW,VH);
  cx.save();
  if(G.shake>0)cx.translate((Math.random()-0.5)*G.shake*20,(Math.random()-0.5)*G.shake*12);
  drawBG();
  for(var i=0;i<G.platforms.length;i++)drawPlatform(G.platforms[i]);
  if(G.star)for(var i=0;i<G.star.length;i++)drawStar(G.star[i]);
  for(var i=0;i<G.part.length;i++){var q=G.part[i];
    cx.globalAlpha=Math.min(1,q.l*2.2);blob(q.x-G.camX,q.y-G.camY,q.r,q.c);
  }
  cx.globalAlpha=1;
  drawAim();
  if(!G.dead)drawUnicorn();
  cx.restore();
  if(G.menu){drawMenu();}
  else{
    drawHints();
    drawUI();
  }
  if(G.over)drawOver();
}

// ---------- Main loop ----------
newGame();
function loop(ts){
  if(t0)DT=(ts-t0)/1000;t0=ts;
  now=ts/1000;
  step();
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(function(ts){t0=ts;requestAnimationFrame(loop);});

})();
