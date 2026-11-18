module top;
  task automatic t(input integer n);
    begin #2 $display("%0d", n); end
  endtask
  initial t(1);
  initial #1 t(2);
endmodule
