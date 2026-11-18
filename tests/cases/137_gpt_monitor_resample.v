module top;
  reg a;
  initial begin
    a=0; $monitor("%0d %b",$time,a);
    #1 begin a=1; a=0; end
    #1 $monitoroff;
    #1 $monitoron;
  end
endmodule
