import{w as T}from"./base.D09LpZ8K.js";const R=24,f=34,v=[0,.01471,.02941,.04412,.05882,.07353,.08824,.10294,.11765,.13235,.14706,.16176,.17647,.19118,.20588,.22059,.23529,.25,.26471,.27941,.29412,.30882,.32353,.33824,.35294,.36765,.38235,.39706,.41176,.42647,.44118,.45588,.47059,.48529,.5,.51471,.52941,.54412,.55882,.57353,.58824,.60294,.61765,.63235,.64706,.66176,.67647,.69118,.70588,.72059,.73529,.75,.76471,.77941,.79412,.80882,.82353,.83824,.85294,.86765,.88235,.89706,.91176,.92647,.94118,.95588,.97059,.98529,1],n={fps:R,front:f,u:v},g=24,w=46,_=13,A=43,x=58,P=86,b=154,D=122,S=640,U=1024,t={fps:g,landed:w,spring:_,touch:A,point:x,ask:P,loop:b,still:D,width:S,height:U},r=T("/media/mrlad"),L={fps:n.fps,frontFrame:n.front,curve:n.u,sources:[{src:`${r}/turn-600.mp4`,type:'video/mp4; codecs="avc1.64001E"',media:"(max-width: 767.98px)",width:264,height:600},{src:`${r}/turn-600.webm`,type:'video/webm; codecs="vp9"',media:"(max-width: 767.98px)",width:264,height:600},{src:`${r}/turn-960.mp4`,type:'video/mp4; codecs="avc1.64001F"',width:422,height:960},{src:`${r}/turn-960.webm`,type:'video/webm; codecs="vp9"',width:422,height:960}]},N={fps:t.fps,spring:t.spring,touch:t.touch,landed:t.landed,point:t.point,ask:t.ask,loop:t.loop,still:t.still,aspect:t.width/t.height,sources:[{src:`${r}/jump-480.webm`,type:'video/webm; codecs="vp9"',media:"(max-width: 767.98px)",width:300,height:480},{src:`${r}/jump-480.mp4`,type:'video/mp4; codecs="avc1.640028"',media:"(max-width: 767.98px)",width:300,height:480},{src:`${r}/jump-800.webm`,type:'video/webm; codecs="vp9"',width:500,height:800},{src:`${r}/jump-800.mp4`,type:'video/mp4; codecs="avc1.640028"',width:500,height:800}]},y=`
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`,F=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D frame;
varying vec2 uv;
void main() {
  vec3 colour = texture2D(frame, vec2(uv.x, uv.y * 0.5)).rgb;
  float alpha = texture2D(frame, vec2(uv.x, 0.5 + uv.y * 0.5)).g;
  alpha = clamp((alpha - 0.03) / 0.94, 0.0, 1.0);
  gl_FragColor = vec4(min(colour, vec3(alpha)), alpha);
}`;function G(i,u){const e=i.getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:"low-power"});if(!e)return null;const p=(a,s)=>{const c=e.createShader(a);return c?(e.shaderSource(c,s),e.compileShader(c),e.getShaderParameter(c,e.COMPILE_STATUS)?c:null):null},d=p(e.VERTEX_SHADER,y),h=p(e.FRAGMENT_SHADER,F),o=e.createProgram();if(!d||!h||!o||(e.attachShader(o,d),e.attachShader(o,h),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS)))return null;e.useProgram(o);const m=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,m),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW);const l=e.getAttribLocation(o,"p");e.enableVertexAttribArray(l),e.vertexAttribPointer(l,2,e.FLOAT,!1,0,0);const E=e.createTexture();return e.bindTexture(e.TEXTURE_2D,E),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.clearColor(0,0,0,0),i.addEventListener("webglcontextlost",a=>{a.preventDefault(),u()},{once:!0}),{fit(a,s){i.width=a,i.height=s},draw(a){try{return e.viewport(0,0,i.width,i.height),e.texImage2D(e.TEXTURE_2D,0,e.RGB,e.RGB,e.UNSIGNED_BYTE,a),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.getError()===e.NO_ERROR}catch{return!1}}}}export{N as J,L as T,G as c};
