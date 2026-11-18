module t;
  initial begin
    #3 disable worker;
    $display("killed worker");
  end
  initial begin : worker
    #10 $display("worker finished");
  end
endmodule
