module top;
  task t; reg [3:0] loc; begin loc = 4; $display("%0d", t.loc); end endtask
  initial t;
endmodule
