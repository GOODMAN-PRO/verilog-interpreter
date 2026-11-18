module top;
  task t;
    integer x;
    begin x=42; end
  endtask
  initial begin t; $display("%0d",t.x); end
endmodule
