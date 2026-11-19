module t;
  function integer f; input a; reg [3:0] a; f = a; endfunction
  initial $display(f(5));
endmodule
