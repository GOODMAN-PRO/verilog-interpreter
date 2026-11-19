module t;
 parameter X = 1'bx;
 initial begin
  $display(X ? "ab" : "cd");
  $display("%s", X ? "ab" : "ab");
  $display("%h", X ? "ab" : "cd");
 end
endmodule
