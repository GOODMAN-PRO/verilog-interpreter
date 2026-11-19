module top;
  function [1:0] f(input recurse);
    if (recurse) begin f = 2'b10; f[0] = f(0); end
    else f = 2'b01;
  endfunction
  initial $display("%b", f(1));
endmodule
