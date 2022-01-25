const xIn = 1000000000000000000000000;
const _x = 100000001000000000000000000;
const _y = 100000001000000000000000000;


console.log(100000000e18*100000000e18*100000000e18)


x0 = _x+xIn;
xy = k(_x,_y,0,0);
xye18 = ke18(_x,_y,0,0)
y = _y

//console.log("x0",x0)
//console.log("xy",xy)
//console.log("y",y)

//console.log("f0",f(x0,xy,y));

const _f1 = f1(x0,y)
const _f1e18 = f1e18(x0,y)
console.log("f1",_f1);
console.log("f1e18",_f1e18);


const _f0 = f(x0,xy,y)
const _f0e18 = fe18(x0,xye18,y)
console.log("f0",_f0);
console.log("f0e18",_f0e18);

console.log("d", _f0/_f1)
console.log("de18", (_f0e18/_f1e18)*1e18)

const n = newt(x0,xy,y)
const ne18 = newte18(x0,xye18,y)
console.log("n", n)
console.log("ne18", ne18)
//console.log("_y-n", (_y-n))
y = _y - n
ye18 = _y - ne18;

console.log("y", y)
console.log("ye18", ye18)

function k(x, y, a, b) {
    x = x+a;
    y = y-b;

    return (x*y)*(x*x+y*y)
}


function ke18(x, y, a, b) {
    x = x+a;
    y = y-b;

    return (x*y)/1e18*(x*x/1e18+y*y/1e18)/1e18
}

function f1(x0, y) {
    //3*(y-b)*(x+a)^2-3*y*x^2+(y-b)^3-y^3
    return 3*x0*(y*y)+(x0*x0*x0)
}

function f1e18(x0, y) {
    //3*(y-b)*(x+a)^2-3*y*x^2+(y-b)^3-y^3
    return 3*x0*(y*y/1e18)/1e18+(x0*x0/1e18*x0/1e18)
}

function f(x0, xy, y) {
    //(y-b)*(x+a)^3-y*x^3+(y-b)^3*(x+a)-y^3*x
    return x0*(y*y*y)+(x0*x0*x0)*y-xy;
}

function fe18(x0, xy, y) {
    //(y-b)*(x+a)^3-y*x^3+(y-b)^3*(x+a)-y^3*x
    return x0*(y*y/1e18*y/1e18)/1e18+(x0*x0/1e18*x0/1e18)*y/1e18-xy;
}

// (x+a)^3*(y-b)+(y-b)^3*(x+a)=x^3*y+y^3*x

function newt(x0, xy, y) {
    for (i = 0; i < 255; i++) {
      y_prev = y;
      y = y - (f(x0,xy,y)/f1(x0,y));
      if (y > y_prev) {
            if (y - y_prev <= 1) {
                return y
            }
      } else {
            if (y_prev - y <= 1) {
                return y
            }
      }
    }
    return y
}

function newte18(x0, xy, y) {
    for (i = 0; i < 255; i++) {
      y_prev = y;
      d = fe18(x0,xy,y)/f1e18(x0,y)
      y = y - (d*1e18);
      if (y > y_prev) {
            if (y - y_prev <= 1) {
                console.log("newte18 i",i)
                return y
            }
      } else {
            if (y_prev - y <= 1) {
                console.log("newte18 i",i)
                return y
            }
      }
    }
    console.log("newte18 i",i)
    return y
}
