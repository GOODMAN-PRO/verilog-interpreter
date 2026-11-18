module tb;
  integer n;
  function automatic integer factorial;
    input integer value;
    begin
      if (value <= 1) factorial = 1;
      else factorial = value * factorial(value - 1);
    end
  endfunction
  function automatic integer fibonacci(input integer value);
    integer left, right;
    begin
      if (value < 2) fibonacci = value;
      else begin
        left = fibonacci(value - 1);
        right = fibonacci(value - 2);
        fibonacci = left + right;
      end
    end
  endfunction
  initial begin
    for (n = 0; n < 7; n = n + 1)
      $display("n=%0d factorial=%0d fibonacci=%0d", n, factorial(n), fibonacci(n));
    $finish;
  end
endmodule