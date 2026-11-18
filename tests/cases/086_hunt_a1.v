module t;
 task automatic tick(input integer n); begin repeat(n) #1; $display("ticked %0d at %0t", n, $time); end endtask
 initial begin
  fork tick(3); tick(2); join
 end
endmodule
