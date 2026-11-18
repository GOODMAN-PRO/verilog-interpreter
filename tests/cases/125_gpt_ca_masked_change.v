module top;
  reg a, b;
  wire q;
  assign #5 q = a | b;
  initial begin
    a=0; b=0;
    #10 a=1;
    #2 b=1;
    #4 $display("%b", q);
  end
endmodule
