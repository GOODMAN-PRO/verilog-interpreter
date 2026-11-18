module tb;
  integer i, total, count;
  reg tick;
  initial begin
    total = 0;
    for (i = 0; i < 5; i = i + 1) total = total + i;
    $display("for total=%0d i=%0d", total, i);
    count = 4;
    while (count > 0) begin
      total = total + count;
      count = count - 1;
    end
    $display("while total=%0d count=%0d", total, count);
    count = 3;
    repeat (count) begin
      total = total + 2;
      count = count - 1;
    end
    repeat (0) total = -1;
    $display("repeat total=%0d count=%0d", total, count);
    tick = 0;
    begin : clock_loop
      forever begin
        #2 tick = ~tick;
        count = count + 1;
        $display("forever count=%0d tick=%b time=%0d", count, tick, $time);
        if (count == 4) disable clock_loop;
      end
    end
    $finish;
  end
endmodule