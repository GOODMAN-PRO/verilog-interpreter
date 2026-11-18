module leaf;
  assign w=1'b1;
  initial #1 $display("%b", w);
endmodule
module top;
  task w; ; endtask
  leaf u();
endmodule
