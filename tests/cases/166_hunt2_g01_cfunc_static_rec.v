module top; function integer fib(input integer n); if (n<2) fib=n; else fib = fib(n-1)+fib(n-2); endfunction
localparam F = fib(6); initial $display("%0d", F); endmodule
