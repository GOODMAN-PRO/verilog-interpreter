module t;
  reg a;
  wire b = ~a;
  always @(b) begin
    $display("%0t b=%b", $time, b);
    if (b) a = 1;
  end
  initial #1 a = 0;
endmodule
