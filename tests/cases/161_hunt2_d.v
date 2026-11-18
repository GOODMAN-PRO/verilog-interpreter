module t;
  function reg [3:0] g(input [3:0] a); g = a; endfunction
  initial $display("%0d", g(5));
endmodule
