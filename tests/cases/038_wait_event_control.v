module tb;
  reg ready, pulse;
  integer data;
  initial begin
    ready = 0;
    pulse = 0;
    data = 0;
    fork
      begin
        wait (ready);
        #1 $display("wait data=%0d time=%0d", data, $time);
        @(posedge pulse);
        #1 $display("edge data=%0d time=%0d", data, $time);
        wait (ready);
        $display("already ready time=%0d", $time);
      end
      begin
        #2 ready = 1'bx;
        #2 ready = 0;
        #2 data = 7; ready = 1;
        #3 data = 9; pulse = 1;
      end
    join
    $finish;
  end
endmodule