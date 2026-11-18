module tb;
  integer i, total;
  initial begin
    total = 0;
    begin : scan
      integer accepted;
      reg [3:0] last_value;
      accepted = 0;
      last_value = 0;
      for (i = 0; i < 10; i = i + 1) begin : iteration
        if ((i % 2) == 0) disable iteration;
        if (i == 7) disable scan;
        accepted = accepted + 1;
        last_value = i;
        total = total + i;
        $display("accepted=%0d last=%0d total=%0d", accepted, last_value, total);
      end
      $display("unreachable");
    end
    $display("after scan i=%0d total=%0d accepted=%0d last=%0d",
             i, total, scan.accepted, scan.last_value);
    $finish;
  end
endmodule