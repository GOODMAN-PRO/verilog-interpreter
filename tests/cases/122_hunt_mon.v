module t;
  reg [3:0] a = 1;
  initial begin
    $monitor("mon a=%0d t=%0t", a, $time);
    #1 $monitoroff;
    #1 $monitoron;
    #1 a = 2;
  end
endmodule
