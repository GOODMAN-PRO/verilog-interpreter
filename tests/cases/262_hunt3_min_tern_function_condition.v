module t;
 parameter A = "ab", B = "cd";
 function integer f; input integer a; f = a > 0; endfunction
 initial begin
  $display(f(1) ? A : B);
  $display($clog2(4) ? A : B);
  $display((2 > 1) ? A : B);
  $display(f(0) ? "ab" : "cd");
 end
endmodule
