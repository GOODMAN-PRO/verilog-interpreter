module t;
function integer f; input integer n;
  begin if (n == 0) f = 0; else f = f(n-1) + n; end
endfunction
initial $display("%0d", f(3));
endmodule
