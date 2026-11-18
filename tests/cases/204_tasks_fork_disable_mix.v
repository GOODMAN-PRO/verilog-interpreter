module tb;
  integer i, acc; reg [3:0] q; reg clk = 0;
  task automatic walk(input integer n, output integer sum);
    integer part; reg [7:0] mem [0:3];
    begin : body
      mem[n % 4] = n; sum = 0;
      if (n > 0) begin walk(n - 1, part); sum = part + mem[n % 4]; end
      if (n == 99) disable body;
    end
  endtask
  function automatic integer fib(input integer n); fib = n < 2 ? n : fib(n - 1) + fib(n - 2); endfunction
  function integer stat(input integer n); begin : s integer t; t = n * 2; stat = t; end endfunction
  always #5 clk = ~clk;
  always @(posedge clk) q <= q + 1;
  initial begin
    q = 0; walk(6, acc); $display("%0d %0d %0d", acc, fib(12), stat(21));
    fork : f
      begin : a1 #100 $display("slow"); end
      begin : a2 @(posedge clk); @(posedge clk); $display("%0t two edges q=%0d", $time, q); disable f; end
    join
    $display("%0t after", $time);
    fork
      begin : w1 #50 $display("w1 done"); end
      #7 disable w1;
      begin #9 $display("%0t third", $time); end
    join
    $display("%0t end q=%0d", $time, q);
    q <= @(negedge clk) 4'd9; @(negedge clk); #1 $display("%0t q=%0d", $time, q);
    $finish;
  end
endmodule
