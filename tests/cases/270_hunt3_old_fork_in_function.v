module t;
  function integer f2; input a; begin fork f2 = a; join end endfunction
  function integer f3; input a; begin fork : b f3 = a; f3 = f3 + 1; join end endfunction
  initial $display("%0d %0d", f2(5), f3(7));
endmodule
