module tb;
  reg done = 0; integer i;
  task automatic slow(input integer n, output integer r); begin #n r = n * 2; end endtask
  initial begin : main
    integer a, b;
    fork : race
      begin #50 $display("%0t timeout", $time); disable race; end
      begin @(posedge done); $display("%0t done first", $time); disable race; end
    join
    $display("%0t after race", $time);
    fork slow(3, a); slow(5, b); join
    $display("%0t a=%0d b=%0d", $time, a, b);
    begin : outer
      for (i = 0; i < 10; i = i + 1) begin : body
        if (i == 2) disable body;
        if (i == 5) disable outer;
        $display("i=%0d", i);
      end
    end
    #100 $display("%0t end", $time); $finish;
  end
  initial #20 done = 1;
  initial begin : watchdog #1000 $display("watchdog"); end
  initial begin #130 disable watchdog; $display("%0t watchdog cancelled", $time); end
  always @(posedge done) begin : pulse #7 $display("%0t pulse", $time); end
  initial #25 disable pulse;
endmodule
