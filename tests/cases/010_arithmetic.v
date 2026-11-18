module tb;
  reg signed [15:0] a, b;
  integer i;
  initial begin
    a = -17;
    b = 5;
    $display("arith %0d %0d %0d %0d %0d", a+b, a-b, a*b, a/b, a%b);
    $display("reverse %0d %0d", b/a, b%a);
    b = -5;
    $display("negative %0d %0d", a/b, a%b);
    a = 17;
    $display("mixed %0d %0d", a/b, a%b);
    for (i = 0; i < 5; i = i + 1)
      $display("power %0d %0d %0d", i, 3**i, (-2)**i);
    $display("unary %0d %0d %0d", +a, -a, -(-a));
    $finish;
  end
endmodule
