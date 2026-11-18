module sub(input x); initial #1 $display("%b",x); endmodule
module top;
  function f(input x); f=x; endfunction
  sub u(f(missing));
endmodule
