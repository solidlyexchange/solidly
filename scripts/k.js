const xIn = 1000000000000;
const _x = 100000001000000000000000000;
const _y = 100000001000000000000000000;

yOut = get_y(xIn,_x,_y);

const a = 100000001000000000000000000;

console.log(a*a/1e18*a/1e18)


function get_y(xIn, a, b) {
  x = xIn + a;
  a3 = a*a/1e18*a/1e18
  x2 = x*x/1e18
  b3 = b*b/1e18*b/1e18
  c0 = 27*a3*b/1e18*x2/1e18+27*a*b3/1e18*x2/1e18;
  console.log("c0",c0)
  console.log("c0*c0",c0*c0)
  _c1 = (Math.sqrt(c0*c0+108*x**12)+c0)
  console.log(_c1)
  c1 = Math.cbrt(_c1)
  b1 = (3*2**(1/3)*x)
  b1 = 3*Math.cbrt(2)*x
  b2 = ((2**(1/3))*(x**3))
  console.log("c1", c1);
  console.log("b1", b1);
  console.log("b2", b2);
  console.log("c1/b1 %s", c1/b1);
  console.log("b2/c1 %s", b2/c1);
  y = c1/b1-b2/c1
  console.log("y", b-y)
}

/*function get_y(xIn, a, b) {
  x = xIn + a;
  y0 = Math.cbrt(Math.sqrt(((27*(a**3)*b*(x**2)+27*a*(b**3)*(x**2))**2)+108*x**12)+27*(a**3)*b*(x**2)+27*a*(b**3)*(x**2))
  y1 = y0 / 3*Math.cbrt(2)*x
  y2 = Math.cbrt(2)*(x**3) / y0
  y = y1 - y2
  console.log(y)
  console.log(b-y)
}*/

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
}

function _k(_x, _y) {
  _a = (_x * _y) ;
  _b = ((_x * _x)  + (_y * _y) );
  return _a * _b  / 2;  // x3y+y3x >= k
}
