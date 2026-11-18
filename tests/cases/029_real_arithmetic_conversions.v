module tb;
  real a, b, quotient, power;
  integer rounded, truncated;
  initial begin
    a = 7.5;
    b = 2.0;
    quotient = a / b;
    power = b ** 3.0;
    rounded = a;
    truncated = $rtoi(a);
    $display("real %0.2f %0.2f %0.2f %0.2f %0.2f", a+b, a-b, a*b, quotient, power);
    $display("positive round=%0d truncate=%0d back=%0.1f", rounded, truncated, $itor(truncated));
    a = -7.5;
    rounded = a;
    truncated = $rtoi(a);
    $display("negative round=%0d truncate=%0d back=%0.1f", rounded, truncated, $itor(truncated));
    $display("compare %b %b logical=%b", a < b, a == b, a && b);
    $finish;
  end
endmodule
