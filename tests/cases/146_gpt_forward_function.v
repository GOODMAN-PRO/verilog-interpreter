module top;
  localparam P=f(1);
  function integer f(input integer n); f=n+1; endfunction
  initial $display("%0d",P);
endmodule
