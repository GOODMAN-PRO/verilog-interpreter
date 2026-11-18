module top;
  function f(input v); begin $finish; f=v; end endfunction
  localparam X=f(1'b1);
  initial $display("%b", X);
endmodule
