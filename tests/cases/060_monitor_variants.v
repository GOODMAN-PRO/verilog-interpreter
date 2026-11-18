`timescale 1ns/1ps
module tb;
  reg [7:0] q;
  initial begin
    q=1;
    $monitor("decimal t=%0d q=%0d",$time,q);
    #1 q=2;
    #1 begin q=3; q<=4; end
    #1 $monitoroff;
    q=5;
    #1 $monitoron;
    #1 $monitorb("binary:",q);
    #1 q=8'ha5;
    #1 $monitorh("hex:",q);
    #1 q=8'bxxzz_0011;
    #1 $monitoro("octal:",q);
    #1 q=8'd63;
    #1 $monitoroff;
    $finish;
  end
endmodule
