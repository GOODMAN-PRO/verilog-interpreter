module t;
  integer i, s;
  initial begin
    s = 0;
    for (i = 0; i < 11000000; i = i + 1) s = s + (i & 3);
    $display("%0d", s);
  end
endmodule
