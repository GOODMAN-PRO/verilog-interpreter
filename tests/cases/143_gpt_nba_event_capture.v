module top;
  reg a,clk,q;
  initial begin
    clk=0; a=0;
    q <= @(posedge clk) a;
    #1 a=1;
    #1 clk=1;
    #1 $display("%b",q);
  end
endmodule
