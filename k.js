const xIn = 200;
const x = 1000;
const y = 1000;

yOut = getAmountOut(xIn,x,y);
yOut2 = getAmountOutAnalytical(xIn,x,y);
console.log('Iterative:', yOut)
console.log('Analytical:', yOut2)


// getAmountOut gives the amount that will be returned given the amountIn for tokenIn
function getAmountOut(xIn, x, y) {
  console.log("_k1",_k(x,y));
  _kB = Math.sqrt(Math.sqrt(_k(x, y))) * 2;
  console.log("_kB", _kB);
  _kA1 = Math.sqrt(Math.sqrt(_k(x+xIn, y))) * 2;
  yOutAbove = (_kA1 - _kB);

  _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOutAbove))) * 2;

  while (_kA2 < _kB) {
    diff = _kB - _kA2;
    yOutAbove = yOutAbove - diff
    console.log("yOutAbove", yOutAbove);
    _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOutAbove))) * 2;
  }

  yOutBelow = yOutAbove;
  _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOutAbove))) * 2;

  console.log("_kA2", _kA2);
  while (_kA2 > _kB) {
    diff = _kA2 - _kB;
    yOutBelow = yOutBelow + diff
    _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOutBelow))) * 2;
  }

  console.log(yOutAbove);
  console.log(yOutBelow);
  yOut = (yOutBelow+yOutAbove)/2;
  _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOut))) * 2;
  /*while (_kA2 != _kB) {
    diff = _kA2 - _kB;
    yOut = (yOutBelow+yOutAbove)/2;
    console.log(yOut);
    _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOut))) * 2;
  }*/

  for (i = 0; i < 255; i++) {
    _kA2 = Math.sqrt(Math.sqrt(_k(x+xIn, y-yOut))) * 2;

    console.log("_kA2",_kA2);
    if (_kA2 > _kB) {
      yOut = (yOut+yOutBelow)/2
    } else if (_kA2 < _kB) {
      yOut = (yOut+yOutAbove)/2
    } else {
      return yOut
    }
  }
  console.log("_k2 yOutAbove",_k(x+xIn,y-yOutAbove));
  console.log("_k2 yOutBelow",_k(x+xIn,y-yOutBelow));
  console.log("_k2 yOut",_k(x+xIn,y-yOut));
  return yOut;
}

function getAmountOutAnalytical(a, x, y) {

  let k = _k(x,y)*2;
  let cuberoot2 = 2**(1/3);
  let term1 = 3*a**4 + 12*a**3*x + 18*a**2*x**2 + 12*a*x**3 + 3*x**4;
  let term2 = (-27*a**2*k + Math.sqrt((-27*a**2*k - 54*a*k*x - 27*k*x**2)**2 + 4*term1**3) - 54*a*k*x - 27*k*x**2)**(1/3);
  let b = -(cuberoot2*(term1))/(3*(a+x)*term2) + term2 / (3*cuberoot2*(a + x)) + (a*y + x*y)/(a + x);

  return b;
}

function _k(_x, _y) {
  _a = (_x * _y) ;
  _b = ((_x * _x)  + (_y * _y) );
  return _a * _b  / 2;  // x3y+y3x >= k
}
