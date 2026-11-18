module top;
  function f(input x); reg v; begin if (x) v=1; f=v; end endfunction
  parameter A=f(1), B=f(0);
  initial $display("%b%b", A,B);
endmodule
